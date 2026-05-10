import { FormEvent, useEffect, useMemo, useState } from "react";
import { AiReportPanel } from "../components/AiReportPanel";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAssets } from "../services/assetsService";
import { generatePortfolioReport, type AiReport } from "../services/browserAiService";
import {
    buyAsset,
    getClosedTrades,
    getSimulator,
    resetPortfolio,
    seedDemoPortfolio,
    sellLot,
    updateAccount,
    type ClosedTrade
} from "../services/browserPortfolioService";
import { getMarketPrice } from "../services/marketDataService";
import type {
    MarketPrice,
    PortfolioLotView,
    PortfolioSimulator,
    PortfolioTransaction
} from "../types/domain";

export function PortfolioPage() {
    const assets = useMemo(() => getAssets(), []);

    const [simulator, setSimulator] = useState<PortfolioSimulator | null>(null);
    const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
    const [rubBalance, setRubBalance] = useState("");
    const [usdBalance, setUsdBalance] = useState("");
    const [buyTicker, setBuyTicker] = useState(assets[0]?.ticker ?? "SBER");
    const [buyQuantity, setBuyQuantity] = useState("");
    const [buyQuote, setBuyQuote] = useState<MarketPrice | null>(null);
    const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});
    const [sellQuantities, setSellQuantities] = useState<Record<string, string>>({});
    const [report, setReport] = useState<AiReport | null>(null);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadBuyQuote() {
            try {
                setBuyQuote(null);
                const quote = await getMarketPrice(buyTicker);

                if (isMounted) {
                    setBuyQuote(quote);
                }
            } catch {
                if (isMounted) {
                    setBuyQuote(null);
                }
            }
        }

        loadBuyQuote();

        return () => {
            isMounted = false;
        };
    }, [buyTicker]);

    async function refresh() {
        setIsLoading(true);

        const loadedSimulator = await getSimulator();
        const loadedClosedTrades = getClosedTrades();

        setSimulator(loadedSimulator);
        setClosedTrades(loadedClosedTrades);
        setRubBalance(String(loadedSimulator.account.rubBalance));
        setUsdBalance(String(loadedSimulator.account.usdBalance));
        setIsLoading(false);
    }

    function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        updateAccount({
            rubBalance: Number(rubBalance),
            usdBalance: Number(usdBalance)
        });

        refresh();
    }

    async function handleBuy(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        try {
            setError("");
            setReport(null);
            await buyAsset(buyTicker.trim().toUpperCase(), Number(buyQuantity));
            setBuyQuantity("");
            await refresh();
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Ошибка покупки");
        }
    }

    async function handleSell(lot: PortfolioLotView) {
        try {
            setError("");
            setReport(null);
            await sellLot(lot.id, Number(sellQuantities[lot.id]));
            setSellQuantities((current) => ({ ...current, [lot.id]: "" }));
            await refresh();
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Ошибка продажи");
        }
    }

    async function handleGenerateReport() {
        if (!simulator) {
            return;
        }

        try {
            setError("");
            setIsGeneratingReport(true);
            const nextReport = await generatePortfolioReport(simulator);
            setReport(nextReport);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Ошибка AI-анализа портфеля");
        } finally {
            setIsGeneratingReport(false);
        }
    }

    async function handleSeedDemo() {
        seedDemoPortfolio();
        setReport(null);
        await refresh();
    }

    async function handleReset() {
        resetPortfolio();
        setReport(null);
        await refresh();
    }

    const selectedAsset = useMemo(() => {
        return assets.find((asset) => asset.ticker === buyTicker) ?? null;
    }, [assets, buyTicker]);

    const buyCalculator = useMemo(() => {
        const quantity = Number(buyQuantity);

        if (!selectedAsset || !buyQuote || !Number.isFinite(quantity) || quantity <= 0) {
            return {
                total: 0,
                afterBalance: 0
            };
        }

        const total = quantity * buyQuote.price;
        const currentBalance =
            selectedAsset.currency === "RUB"
                ? simulator?.account.rubBalance ?? 0
                : simulator?.account.usdBalance ?? 0;

        return {
            total,
            afterBalance: currentBalance - total
        };
    }, [buyQuantity, buyQuote, selectedAsset, simulator?.account.rubBalance, simulator?.account.usdBalance]);

    const realizedStats = useMemo(() => {
        const rubTrades = closedTrades.filter((trade) => trade.currency === "RUB");
        const usdTrades = closedTrades.filter((trade) => trade.currency === "USD");

        const bestTrade =
            closedTrades.length === 0
                ? null
                : [...closedTrades].sort(
                    (first, second) =>
                        second.realizedProfitLossPercent - first.realizedProfitLossPercent
                )[0];

        const worstTrade =
            closedTrades.length === 0
                ? null
                : [...closedTrades].sort(
                    (first, second) =>
                        first.realizedProfitLossPercent - second.realizedProfitLossPercent
                )[0];

        return {
            rubRealized: rubTrades.reduce((sum, trade) => sum + trade.realizedProfitLoss, 0),
            usdRealized: usdTrades.reduce((sum, trade) => sum + trade.realizedProfitLoss, 0),
            bestTrade,
            worstTrade
        };
    }, [closedTrades]);

    const recentTransactions = useMemo(() => {
        if (!simulator) {
            return [];
        }

        return simulator.transactions.slice(0, 8);
    }, [simulator]);

    const bestTradeSummary = realizedStats.bestTrade
        ? `${realizedStats.bestTrade.ticker} · ${formatPercent(realizedStats.bestTrade.realizedProfitLossPercent)}`
        : "—";

    const worstTradeSummary = realizedStats.worstTrade
        ? `${realizedStats.worstTrade.ticker} · ${formatPercent(realizedStats.worstTrade.realizedProfitLossPercent)}`
        : "—";

    if (isLoading || !simulator) {
        return <LoadingBlock text="Загружаем портфель..." />;
    }

    return (
        <section className="page portfolio-page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Портфель</p>
                    <h1>Симулятор инвестиций</h1>
                </div>

                <div className="hero-actions">
                    <button type="button" className="ghost-button" onClick={handleSeedDemo}>
                        Демо-данные
                    </button>

                    <button type="button" className="ghost-button danger-button" onClick={handleReset}>
                        Сбросить
                    </button>

                    <button
                        type="button"
                        className="primary-button"
                        disabled={isGeneratingReport}
                        onClick={handleGenerateReport}
                    >
                        {isGeneratingReport ? "Анализируем..." : "AI-отчёт"}
                    </button>
                </div>
            </div>

            {error && <div className="error-block">{error}</div>}

            <div className="portfolio-top-grid compact-portfolio-top-grid">
                <article className="panel portfolio-account-panel compact-panel">
                    <div className="panel-header compact-panel-header">
                        <div>
                            <h2>Счёт</h2>
                        </div>
                    </div>

                    <div className="portfolio-account-grid compact-account-grid">
                        <AccountCard label="RUB" value={formatMoney(simulator.account.rubBalance, "RUB")} />
                        <AccountCard label="USD" value={formatMoney(simulator.account.usdBalance, "USD")} />

                        <form className="portfolio-account-form compact-form-grid" onSubmit={handleSaveAccount}>
                            <label>
                                <span>RUB баланс</span>
                                <input
                                    value={rubBalance}
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    onChange={(event) => setRubBalance(event.target.value)}
                                />
                            </label>

                            <label>
                                <span>USD баланс</span>
                                <input
                                    value={usdBalance}
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    onChange={(event) => setUsdBalance(event.target.value)}
                                />
                            </label>

                            <button type="submit" className="primary-button">
                                Сохранить
                            </button>
                        </form>
                    </div>
                </article>

                <article className="panel portfolio-buy-panel compact-panel">
                    <div className="panel-header compact-panel-header">
                        <div>
                            <h2>Покупка</h2>
                        </div>
                    </div>

                    <form className="portfolio-buy-form compact-form-grid" onSubmit={handleBuy}>
                        <label>
                            <span>Актив</span>
                            <select
                                value={buyTicker}
                                onChange={(event) => setBuyTicker(event.target.value)}
                            >
                                {assets.map((asset) => (
                                    <option key={asset.id} value={asset.ticker}>
                                        {asset.ticker} — {asset.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <span>Количество</span>
                            <input
                                value={buyQuantity}
                                type="number"
                                min="0"
                                step="0.0001"
                                onChange={(event) => setBuyQuantity(event.target.value)}
                            />
                        </label>

                        <button type="submit" className="primary-button">
                            Купить
                        </button>

                        <div className="portfolio-buy-calculator compact-calculator-grid">
                            <CalculatorMetric
                                label="Цена"
                                value={buyQuote && selectedAsset ? formatMoney(buyQuote.price, selectedAsset.currency) : "—"}
                            />
                            <CalculatorMetric
                                label="Потратишь"
                                value={selectedAsset ? formatMoney(buyCalculator.total, selectedAsset.currency) : "—"}
                            />
                            <CalculatorMetric
                                label="После покупки"
                                value={selectedAsset ? formatMoney(buyCalculator.afterBalance, selectedAsset.currency) : "—"}
                                className={buyCalculator.afterBalance >= 0 ? "positive-value" : "negative-value"}
                            />
                        </div>
                    </form>
                </article>
            </div>

            <article className="panel compact-panel">
                <div className="panel-header compact-panel-header">
                    <div>
                        <h2>Активы и лоты</h2>
                    </div>
                </div>

                {simulator.holdings.length === 0 ? (
                    <div className="empty-state">Портфель пустой</div>
                ) : (
                    <div className="portfolio-simulator-holdings compact-holdings">
                        {simulator.holdings.map((holding) => (
                            <div className="portfolio-holding-group portfolio-holding-scroll" key={holding.assetId}>
                                <div className="portfolio-line portfolio-holding-line compact-portfolio-line">
                                    <div className="portfolio-line-title">
                                        <strong>{formatNumber(holding.totalQuantity)} {holding.ticker}</strong>
                                        <span>{holding.name}</span>
                                    </div>

                                    <div className="portfolio-line-metrics compact-portfolio-metrics">
                                        <InlineMetric label="Средняя" value={formatMoney(holding.averageBuyPrice, holding.currency)} />
                                        <InlineMetric label="Сейчас" value={formatMoney(holding.currentPrice, holding.currency)} />
                                        <InlineMetric label="Вложено" value={formatMoney(holding.investedAmount, holding.currency)} />
                                        <InlineMetric label="Стоимость" value={formatMoney(holding.currentValue, holding.currency)} />
                                        <InlineMetric
                                            label="PnL"
                                            value={`${formatMoney(holding.profitLoss, holding.currency)} · ${formatPercent(holding.profitLossPercent)}`}
                                            className={holding.profitLoss >= 0 ? "positive-value" : "negative-value"}
                                        />
                                        <InlineMetric label="Источник" value={holding.currentPriceSource} />
                                    </div>

                                    <div className="portfolio-line-actions compact-portfolio-actions">
                                        <button
                                            type="button"
                                            className="ghost-button"
                                            onClick={() => setBuyTicker(holding.ticker)}
                                        >
                                            Купить
                                        </button>

                                        <button
                                            type="button"
                                            className="primary-button"
                                            onClick={() =>
                                                setExpandedTickers((current) => ({
                                                    ...current,
                                                    [holding.ticker]: !current[holding.ticker]
                                                }))
                                            }
                                        >
                                            {expandedTickers[holding.ticker] ? "Свернуть" : "Развернуть"}
                                        </button>
                                    </div>
                                </div>

                                {expandedTickers[holding.ticker] && (
                                    <div className="portfolio-lot-list compact-lot-list">
                                        {holding.lots.map((lot) => {
                                            const sellQuantity = Number(sellQuantities[lot.id] ?? 0);
                                            const sellAmount =
                                                Number.isFinite(sellQuantity) && sellQuantity > 0
                                                    ? sellQuantity * lot.currentPrice
                                                    : 0;

                                            return (
                                                <div className="portfolio-holding-scroll" key={lot.id}>
                                                    <div className="portfolio-line portfolio-lot-line compact-portfolio-line">
                                                        <div className="portfolio-line-title">
                                                            <strong>
                                                                {formatNumber(lot.remainingQuantity)} {lot.ticker} {formatDateTime(lot.openedAt)}
                                                            </strong>
                                                        </div>

                                                        <div className="portfolio-line-metrics compact-portfolio-metrics">
                                                            <InlineMetric label="Покупка" value={formatMoney(lot.buyPrice, lot.currency)} />
                                                            <InlineMetric label="Сейчас" value={formatMoney(lot.currentPrice, lot.currency)} />
                                                            <InlineMetric label="Вложено" value={formatMoney(lot.investedAmount, lot.currency)} />
                                                            <InlineMetric label="Стоимость" value={formatMoney(lot.currentValue, lot.currency)} />
                                                            <InlineMetric
                                                                label="PnL"
                                                                value={`${formatMoney(lot.profitLoss, lot.currency)} · ${formatPercent(lot.profitLossPercent)}`}
                                                                className={lot.profitLoss >= 0 ? "positive-value" : "negative-value"}
                                                            />
                                                            <InlineMetric label="Получишь" value={formatMoney(sellAmount, lot.currency)} />
                                                        </div>

                                                        <div className="portfolio-line-actions compact-portfolio-actions compact-sell-actions">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={lot.remainingQuantity}
                                                                step="0.0001"
                                                                value={sellQuantities[lot.id] ?? ""}
                                                                placeholder="Кол-во"
                                                                onChange={(event) =>
                                                                    setSellQuantities((current) => ({
                                                                        ...current,
                                                                        [lot.id]: event.target.value
                                                                    }))
                                                                }
                                                            />

                                                            <button
                                                                type="button"
                                                                className="ghost-button danger-button"
                                                                onClick={() => handleSell(lot)}
                                                            >
                                                                Продать
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </article>

            {report && (
                <AiReportPanel
                    title="AI-анализ портфеля"
                    report={report}
                />
            )}

            <details className="panel compact-disclosure">
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>Статистика</h2>
                        <span>
                            Активов {simulator.assetsCount} · Лотов {simulator.lotsCount}
                        </span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    <div className="summary-grid portfolio-summary-grid compact-summary-grid">
                        <Summary label="Активов" value={String(simulator.assetsCount)} />
                        <Summary label="Лотов" value={String(simulator.lotsCount)} />
                        <Summary
                            label="RUB Unrealized"
                            value={formatMoney(simulator.totalRubProfitLoss, "RUB")}
                            className={simulator.totalRubProfitLoss >= 0 ? "positive-value" : "negative-value"}
                        />
                        <Summary
                            label="USD Unrealized"
                            value={formatMoney(simulator.totalUsdProfitLoss, "USD")}
                            className={simulator.totalUsdProfitLoss >= 0 ? "positive-value" : "negative-value"}
                        />
                        <Summary
                            label="RUB Realized"
                            value={formatMoney(realizedStats.rubRealized, "RUB")}
                            className={realizedStats.rubRealized >= 0 ? "positive-value" : "negative-value"}
                        />
                        <Summary
                            label="USD Realized"
                            value={formatMoney(realizedStats.usdRealized, "USD")}
                            className={realizedStats.usdRealized >= 0 ? "positive-value" : "negative-value"}
                        />
                        <Summary label="Лучший трейд" value={bestTradeSummary} />
                        <Summary label="Худший трейд" value={worstTradeSummary} />
                    </div>
                </div>
            </details>

            <details className="panel compact-disclosure">
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>Закрытые сделки</h2>
                        <span>{closedTrades.length}</span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    {closedTrades.length === 0 ? (
                        <div className="empty-state">Закрытых сделок нет</div>
                    ) : (
                        <div className="closed-trade-list compact-secondary-list">
                            {closedTrades.slice(0, 8).map((trade) => (
                                <ClosedTradeCard key={trade.id} trade={trade} />
                            ))}
                        </div>
                    )}
                </div>
            </details>

            <details className="panel compact-disclosure">
                <summary className="compact-disclosure-summary">
                    <div>
                        <h2>История операций</h2>
                        <span>{recentTransactions.length}</span>
                    </div>
                </summary>

                <div className="compact-disclosure-body">
                    {recentTransactions.length === 0 ? (
                        <div className="empty-state">Операций пока нет</div>
                    ) : (
                        <div className="portfolio-transaction-list compact-secondary-list">
                            {recentTransactions.map((transaction) => (
                                <TransactionCard key={transaction.id} transaction={transaction} />
                            ))}
                        </div>
                    )}
                </div>
            </details>
        </section>
    );
}

type AccountCardProps = {
    label: string;
    value: string;
};

function AccountCard({ label, value }: AccountCardProps) {
    return (
        <div className="portfolio-account-card compact-small-card">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

type SummaryProps = {
    label: string;
    value: string;
    className?: string;
};

function Summary({ label, value, className }: SummaryProps) {
    return (
        <div className="summary-card compact-small-card">
            <span>{label}</span>
            <strong className={className}>{value}</strong>
        </div>
    );
}

type InlineMetricProps = {
    label: string;
    value: string;
    className?: string;
};

function InlineMetric({ label, value, className }: InlineMetricProps) {
    return (
        <div className="portfolio-inline-metric">
            <span>{label}</span>
            <strong className={className}>{value}</strong>
        </div>
    );
}

type CalculatorMetricProps = {
    label: string;
    value: string;
    className?: string;
};

function CalculatorMetric({ label, value, className }: CalculatorMetricProps) {
    return (
        <div className="portfolio-calculator-metric compact-small-card">
            <span>{label}</span>
            <strong className={className}>{value}</strong>
        </div>
    );
}

type ClosedTradeCardProps = {
    trade: ClosedTrade;
};

function ClosedTradeCard({ trade }: ClosedTradeCardProps) {
    return (
        <div className="closed-trade-card compact-secondary-card">
            <strong>{trade.ticker}</strong>
            <InlineMetric label="Кол-во" value={formatNumber(trade.quantity)} />
            <InlineMetric label="Вход" value={formatMoney(trade.buyPrice, trade.currency)} />
            <InlineMetric label="Выход" value={formatMoney(trade.sellPrice, trade.currency)} />
            <InlineMetric
                label="PnL"
                value={`${formatMoney(trade.realizedProfitLoss, trade.currency)} · ${formatPercent(trade.realizedProfitLossPercent)}`}
                className={trade.realizedProfitLoss >= 0 ? "positive-value" : "negative-value"}
            />
            <InlineMetric label="Дата" value={formatDateTime(trade.closedAt)} />
        </div>
    );
}

type TransactionCardProps = {
    transaction: PortfolioTransaction;
};

function TransactionCard({ transaction }: TransactionCardProps) {
    return (
        <div className="portfolio-transaction-card compact-secondary-card">
            <span className={transaction.transactionType === "BUY" ? "transaction-buy portfolio-transaction-type" : "transaction-sell portfolio-transaction-type"}>
                {transaction.transactionType === "BUY" ? "Покупка" : "Продажа"}
            </span>

            <strong>{transaction.ticker}</strong>
            <InlineMetric label="Кол-во" value={formatNumber(transaction.quantity)} />
            <InlineMetric label="Цена" value={formatMoney(transaction.price, transaction.currency)} />
            <InlineMetric label="Сумма" value={formatMoney(transaction.totalAmount, transaction.currency)} />
            <InlineMetric label="Дата" value={formatDateTime(transaction.executedAt)} />
        </div>
    );
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 8
    }).format(value);
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

function formatDateTime(value: string): string {
    const date = new Date(value);

    return `${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    })}`;
}