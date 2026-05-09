import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAssets } from "../services/assetsService";
import { getMarketPrice } from "../services/marketDataService";
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
import type {
    MarketPrice,
    PortfolioLotView,
    PortfolioSimulator,
    PortfolioTransaction
} from "../types/domain";
import { LoadingBlock } from "../components/LoadingBlock";

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
            await sellLot(lot.id, Number(sellQuantities[lot.id]));
            setSellQuantities((current) => ({ ...current, [lot.id]: "" }));
            await refresh();
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Ошибка продажи");
        }
    }

    async function handleSeedDemo() {
        seedDemoPortfolio();
        await refresh();
    }

    async function handleReset() {
        resetPortfolio();
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

        const bestTrade = closedTrades.length === 0
            ? null
            : [...closedTrades].sort((first, second) => second.realizedProfitLossPercent - first.realizedProfitLossPercent)[0];

        const worstTrade = closedTrades.length === 0
            ? null
            : [...closedTrades].sort((first, second) => first.realizedProfitLossPercent - second.realizedProfitLossPercent)[0];

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
                </div>
            </div>

            {error && <div className="error-block">{error}</div>}

            <div className="portfolio-top-grid">
                <article className="panel portfolio-account-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Счёт</h2>
                        </div>
                    </div>

                    <div className="portfolio-account-grid">
                        <AccountCard label="RUB" value={formatMoney(simulator.account.rubBalance, "RUB")} />
                        <AccountCard label="USD" value={formatMoney(simulator.account.usdBalance, "USD")} />

                        <form className="portfolio-account-form" onSubmit={handleSaveAccount}>
                            <label>
                                RUB баланс
                                <input
                                    value={rubBalance}
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    onChange={(event) => setRubBalance(event.target.value)}
                                />
                            </label>

                            <label>
                                USD баланс
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

                <article className="panel portfolio-buy-panel">
                    <div className="panel-header">
                        <div>
                            <h2>Покупка</h2>
                        </div>
                    </div>

                    <form className="portfolio-buy-form" onSubmit={handleBuy}>
                        <label>
                            Актив
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
                            Количество
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

                        <div className="portfolio-buy-calculator">
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

            <div className="summary-grid portfolio-summary-grid">
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
            </div>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Активы и лоты</h2>
                    </div>
                </div>

                {simulator.holdings.length === 0 ? (
                    <div className="empty-state">Портфель пустой</div>
                ) : (
                    <div className="portfolio-simulator-holdings">
                        {simulator.holdings.map((holding) => (
                            <div className="portfolio-holding-group" key={holding.assetId}>
                                <div className="portfolio-line portfolio-holding-line">
                                    <div className="portfolio-line-title">
                                        <strong>{formatNumber(holding.totalQuantity)} {holding.ticker}</strong>
                                        <span>{holding.name}</span>
                                    </div>

                                    <div className="portfolio-line-metrics">
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

                                    <div className="portfolio-line-actions">
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
                                            onClick={() => setExpandedTickers((current) => ({
                                                ...current,
                                                [holding.ticker]: !current[holding.ticker]
                                            }))}
                                        >
                                            {expandedTickers[holding.ticker] ? "Свернуть" : "Развернуть"}
                                        </button>
                                    </div>
                                </div>

                                {expandedTickers[holding.ticker] && (
                                    <div className="portfolio-lot-list">
                                        {holding.lots.map((lot) => {
                                            const sellQuantity = Number(sellQuantities[lot.id] ?? 0);
                                            const sellAmount = Number.isFinite(sellQuantity) && sellQuantity > 0
                                                ? sellQuantity * lot.currentPrice
                                                : 0;

                                            return (
                                                <div className="portfolio-line portfolio-lot-line" key={lot.id}>
                                                    <div className="portfolio-line-title">
                                                        <strong>
                                                            {formatNumber(lot.remainingQuantity)} {lot.ticker} {formatDateTime(lot.openedAt)}
                                                        </strong>
                                                    </div>

                                                    <div className="portfolio-line-metrics">
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

                                                    <div className="portfolio-line-actions portfolio-line-sell-actions">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={lot.remainingQuantity}
                                                            step="0.0001"
                                                            value={sellQuantities[lot.id] ?? ""}
                                                            placeholder="Кол-во"
                                                            onChange={(event) => setSellQuantities((current) => ({
                                                                ...current,
                                                                [lot.id]: event.target.value
                                                            }))}
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
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </article>

            <div className="portfolio-bottom-grid">
                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>Закрытые сделки</h2>
                        </div>
                    </div>

                    {closedTrades.length === 0 ? (
                        <div className="empty-state">Закрытых сделок нет</div>
                    ) : (
                        <div className="closed-trade-list">
                            {closedTrades.slice(0, 8).map((trade) => (
                                <ClosedTradeCard key={trade.id} trade={trade} />
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

                    <div className="best-worst-grid">
                        <TradeSpotlight title="Лучший" trade={realizedStats.bestTrade} />
                        <TradeSpotlight title="Худший" trade={realizedStats.worstTrade} />
                    </div>
                </article>
            </div>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Последние операции</h2>
                    </div>
                </div>

                {recentTransactions.length === 0 ? (
                    <div className="empty-state">Операций пока нет</div>
                ) : (
                    <div className="portfolio-transaction-list">
                        {recentTransactions.map((transaction) => (
                            <TransactionCard key={transaction.id} transaction={transaction} />
                        ))}
                    </div>
                )}
            </article>
        </section>
    );
}

type AccountCardProps = {
    label: string;
    value: string;
};

function AccountCard({ label, value }: AccountCardProps) {
    return (
        <div className="portfolio-account-card">
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
        <div className="summary-card">
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
        <div className="portfolio-calculator-metric">
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
        <div className="closed-trade-card">
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

type TradeSpotlightProps = {
    title: string;
    trade: ClosedTrade | null;
};

function TradeSpotlight({ title, trade }: TradeSpotlightProps) {
    if (!trade) {
        return (
            <div className="trade-spotlight-card">
                <span>{title}</span>
                <strong>—</strong>
            </div>
        );
    }

    return (
        <div className="trade-spotlight-card">
            <span>{title}</span>
            <strong>{trade.ticker}</strong>
            <em className={trade.realizedProfitLoss >= 0 ? "positive-value" : "negative-value"}>
                {formatMoney(trade.realizedProfitLoss, trade.currency)} · {formatPercent(trade.realizedProfitLossPercent)}
            </em>
        </div>
    );
}

type TransactionCardProps = {
    transaction: PortfolioTransaction;
};

function TransactionCard({ transaction }: TransactionCardProps) {
    return (
        <div className="portfolio-transaction-card">
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