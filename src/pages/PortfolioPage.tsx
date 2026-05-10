import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AiReportPanel } from "../components/AiReportPanel";
import { getAsset, getAssets } from "../services/assetsService";
import type { AiReport } from "../services/browserAiService";
import { getMarketPrice } from "../services/marketDataService";
import type { Asset } from "../types/domain";

type Currency = "RUB" | "USD";
type ExpandedPanel = "BUY" | "BALANCE" | null;

type AccountBalances = {
    RUB: number;
    USD: number;
};

type PortfolioLot = {
    id: string;
    ticker: string;
    quantity: number;
    purchasePrice: number;
    currency: Currency;
    purchasedAt: string;
};

type ClosedTrade = {
    id: string;
    ticker: string;
    quantity: number;
    purchasePrice: number;
    sellPrice: number;
    currency: Currency;
    purchasedAt: string;
    soldAt: string;
};

type PortfolioTransaction = {
    id: string;
    type: "BUY" | "SELL" | "BALANCE" | "DEMO_ACCOUNT";
    ticker?: string;
    quantity?: number;
    price?: number;
    amount: number;
    currency: Currency;
    createdAt: string;
};

type PersistedPortfolioState = {
    balances: AccountBalances;
    lots: PortfolioLot[];
    closedTrades: ClosedTrade[];
    transactions: PortfolioTransaction[];
};

type GroupedHolding = {
    ticker: string;
    asset: Asset | null;
    currency: Currency;
    quantity: number;
    currentPrice: number;
    totalInvested: number;
    currentValue: number;
    pnl: number;
    pnlPercent: number;
    lots: PortfolioLot[];
};

const PORTFOLIO_STORAGE_KEY = "invest-navigator-portfolio-state";
const LEGACY_STORAGE_KEYS = [
    "invest-navigator-portfolio-state",
    "investNavigatorPortfolioState",
    "invest-navigator-portfolio",
    "portfolio-state"
];

export function PortfolioPage() {
    const assets = useMemo(() => getAssets(), []);
    const [portfolioState, setPortfolioState] = useState<PersistedPortfolioState>(() => {
        return loadPortfolioState();
    });

    const [prices, setPrices] = useState<Record<string, number>>({});
    const [isPriceLoading, setIsPriceLoading] = useState(true);

    const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
    const [expandedHoldings, setExpandedHoldings] = useState<Record<string, boolean>>({});
    const [sellQuantities, setSellQuantities] = useState<Record<string, string>>({});
    const [report, setReport] = useState<AiReport | null>(null);

    const [buyTicker, setBuyTicker] = useState(assets[0]?.ticker ?? "");
    const [buyQuantity, setBuyQuantity] = useState("1");

    const [balanceCurrency, setBalanceCurrency] = useState<Currency>("RUB");
    const [balanceValue, setBalanceValue] = useState("");

    useEffect(() => {
        savePortfolioState(portfolioState);
    }, [portfolioState]);

    useEffect(() => {
        async function loadPrices() {
            setIsPriceLoading(true);

            try {
                const uniqueTickers = Array.from(
                    new Set([
                        ...assets.map((asset) => asset.ticker),
                        ...portfolioState.lots.map((lot) => lot.ticker)
                    ])
                );

                const entries = await Promise.all(
                    uniqueTickers.map(async (ticker) => {
                        try {
                            const marketPrice = await getMarketPrice(ticker);
                            return [ticker, marketPrice.price] as const;
                        } catch {
                            return [ticker, 0] as const;
                        }
                    })
                );

                setPrices(Object.fromEntries(entries));
            } finally {
                setIsPriceLoading(false);
            }
        }

        loadPrices();
    }, [assets, portfolioState.lots]);

    const selectedBuyAsset = useMemo(() => {
        return getAsset(buyTicker);
    }, [buyTicker]);

    const buyCurrentPrice = selectedBuyAsset ? prices[selectedBuyAsset.ticker] ?? 0 : 0;
    const buyQuantityNumber = parsePositiveNumber(buyQuantity);
    const buyCurrency = (selectedBuyAsset?.currency as Currency | undefined) ?? "RUB";
    const buyTotalCost = buyCurrentPrice * buyQuantityNumber;
    const buyBalanceAfter = portfolioState.balances[buyCurrency] - buyTotalCost;

    const groupedHoldings = useMemo<GroupedHolding[]>(() => {
        const groups = new Map<string, PortfolioLot[]>();

        portfolioState.lots.forEach((lot) => {
            const existing = groups.get(lot.ticker) ?? [];
            existing.push(lot);
            groups.set(lot.ticker, existing);
        });

        return Array.from(groups.entries())
            .map(([ticker, lots]) => {
                const asset = getAsset(ticker);
                const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
                const totalInvested = lots.reduce((sum, lot) => sum + lot.quantity * lot.purchasePrice, 0);
                const currentPrice = prices[ticker] ?? 0;
                const currentValue = quantity * currentPrice;
                const pnl = currentValue - totalInvested;
                const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

                return {
                    ticker,
                    asset,
                    currency: (asset?.currency as Currency | undefined) ?? lots[0]?.currency ?? "RUB",
                    quantity,
                    currentPrice,
                    totalInvested,
                    currentValue,
                    pnl,
                    pnlPercent,
                    lots: [...lots].sort((first, second) => {
                        return new Date(second.purchasedAt).getTime() - new Date(first.purchasedAt).getTime();
                    })
                };
            })
            .sort((first, second) => second.currentValue - first.currentValue);
    }, [portfolioState.lots, prices]);

    const statistics = useMemo(() => {
        const lotsCount = portfolioState.lots.length;
        const assetsCount = groupedHoldings.length;

        const unrealized = groupedHoldings.reduce((sum, group) => sum + group.pnl, 0);
        const realized = portfolioState.closedTrades.reduce((sum, trade) => {
            return sum + (trade.sellPrice - trade.purchasePrice) * trade.quantity;
        }, 0);

        return {
            lotsCount,
            assetsCount,
            unrealized,
            realized
        };
    }, [groupedHoldings, portfolioState.closedTrades]);

    function handleTogglePanel(panel: ExpandedPanel) {
        setExpandedPanel((current) => (current === panel ? null : panel));
    }

    function handleSetBalance() {
        const nextValue = parsePositiveNumber(balanceValue);

        setPortfolioState((current) => ({
            ...current,
            balances: {
                ...current.balances,
                [balanceCurrency]: nextValue
            },
            transactions: [
                createTransaction({
                    type: "BALANCE",
                    amount: nextValue,
                    currency: balanceCurrency
                }),
                ...current.transactions
            ]
        }));

        setBalanceValue("");
        setExpandedPanel(null);
    }

    function handleDemoAccount() {
        setPortfolioState((current) => ({
            ...current,
            balances: {
                RUB: 100000,
                USD: 10000
            },
            transactions: [
                createTransaction({
                    type: "DEMO_ACCOUNT",
                    amount: 100000,
                    currency: "RUB"
                }),
                createTransaction({
                    type: "DEMO_ACCOUNT",
                    amount: 10000,
                    currency: "USD"
                }),
                ...current.transactions
            ]
        }));
    }

    function handleAiReport() {
        setReport(buildLocalPortfolioReport(groupedHoldings, statistics));
    }

    function handleBuy() {
        if (!selectedBuyAsset || buyQuantityNumber <= 0 || buyCurrentPrice <= 0) {
            return;
        }

        const currency = selectedBuyAsset.currency as Currency;
        const totalCost = buyCurrentPrice * buyQuantityNumber;

        if (portfolioState.balances[currency] < totalCost) {
            return;
        }

        const nextLot: PortfolioLot = {
            id: cryptoRandomId(),
            ticker: selectedBuyAsset.ticker,
            quantity: buyQuantityNumber,
            purchasePrice: buyCurrentPrice,
            currency,
            purchasedAt: new Date().toISOString()
        };

        setPortfolioState((current) => ({
            ...current,
            balances: {
                ...current.balances,
                [currency]: current.balances[currency] - totalCost
            },
            lots: [nextLot, ...current.lots],
            transactions: [
                createTransaction({
                    type: "BUY",
                    ticker: selectedBuyAsset.ticker,
                    quantity: buyQuantityNumber,
                    price: buyCurrentPrice,
                    amount: totalCost,
                    currency
                }),
                ...current.transactions
            ]
        }));

        setExpandedHoldings((current) => ({
            ...current,
            [selectedBuyAsset.ticker]: true
        }));

        setBuyQuantity("1");
        setExpandedPanel(null);
    }

    function handleSell(lot: PortfolioLot) {
        const requestedQuantity = parsePositiveNumber(sellQuantities[lot.id] || "");

        if (requestedQuantity <= 0 || requestedQuantity > lot.quantity) {
            return;
        }

        const currentPrice = prices[lot.ticker] ?? 0;

        if (currentPrice <= 0) {
            return;
        }

        const proceeds = currentPrice * requestedQuantity;
        const remainingQuantity = lot.quantity - requestedQuantity;

        const nextClosedTrade: ClosedTrade = {
            id: cryptoRandomId(),
            ticker: lot.ticker,
            quantity: requestedQuantity,
            purchasePrice: lot.purchasePrice,
            sellPrice: currentPrice,
            currency: lot.currency,
            purchasedAt: lot.purchasedAt,
            soldAt: new Date().toISOString()
        };

        setPortfolioState((current) => {
            const nextLots = current.lots.flatMap((currentLot) => {
                if (currentLot.id !== lot.id) {
                    return [currentLot];
                }

                if (remainingQuantity <= 0) {
                    return [];
                }

                return [
                    {
                        ...currentLot,
                        quantity: remainingQuantity
                    }
                ];
            });

            return {
                ...current,
                balances: {
                    ...current.balances,
                    [lot.currency]: current.balances[lot.currency] + proceeds
                },
                lots: nextLots,
                closedTrades: [nextClosedTrade, ...current.closedTrades],
                transactions: [
                    createTransaction({
                        type: "SELL",
                        ticker: lot.ticker,
                        quantity: requestedQuantity,
                        price: currentPrice,
                        amount: proceeds,
                        currency: lot.currency
                    }),
                    ...current.transactions
                ]
            };
        });

        setSellQuantities((current) => {
            const nextState = { ...current };
            delete nextState[lot.id];
            return nextState;
        });
    }

    return (
        <section className="page portfolio-page">
            <div className="compact-portfolio-account panel">
                <div className="compact-portfolio-account-grid">
                    <div className="compact-portfolio-balance-card">
                        <span>RUB счёт</span>
                        <strong>{formatMoney(portfolioState.balances.RUB, "RUB")}</strong>
                    </div>

                    <div className="compact-portfolio-balance-card">
                        <span>USD счёт</span>
                        <strong>{formatMoney(portfolioState.balances.USD, "USD")}</strong>
                    </div>
                </div>

                <div className="compact-portfolio-toggle-buttons">
                    <button
                        type="button"
                        className={expandedPanel === "BUY" ? "primary-button" : "ghost-button"}
                        onClick={() => handleTogglePanel("BUY")}
                    >
                        Покупка
                    </button>

                    <button
                        type="button"
                        className={expandedPanel === "BALANCE" ? "primary-button" : "ghost-button"}
                        onClick={() => handleTogglePanel("BALANCE")}
                    >
                        Изменить баланс
                    </button>
                </div>

                <div className="compact-portfolio-extra-buttons">
                    <button type="button" className="ghost-button" onClick={handleDemoAccount}>
                        Демо счёт
                    </button>

                    <button type="button" className="ghost-button" onClick={handleAiReport}>
                        AI-анализ
                    </button>

                    <Link to="/data" className="ghost-button">
                        Данные
                    </Link>
                </div>

                {expandedPanel === "BUY" && (
                    <div className="compact-portfolio-inline-panel">
                        <div className="compact-inline-grid">
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
                                <span>Кол-во</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    value={buyQuantity}
                                    onChange={(event) => setBuyQuantity(event.target.value)}
                                />
                            </label>
                        </div>

                        <div className="compact-buy-preview-row">
                            <div>
                                <span>Цена</span>
                                <strong>{selectedBuyAsset ? formatMoney(buyCurrentPrice, buyCurrency) : "—"}</strong>
                            </div>

                            <div>
                                <span>Потратишь</span>
                                <strong>{selectedBuyAsset ? formatMoney(buyTotalCost, buyCurrency) : "—"}</strong>
                            </div>

                            <div>
                                <span>После покупки</span>
                                <strong>{selectedBuyAsset ? formatMoney(buyBalanceAfter, buyCurrency) : "—"}</strong>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="primary-button"
                            onClick={handleBuy}
                            disabled={
                                !selectedBuyAsset ||
                                buyQuantityNumber <= 0 ||
                                buyCurrentPrice <= 0 ||
                                buyBalanceAfter < 0
                            }
                        >
                            Купить
                        </button>
                    </div>
                )}

                {expandedPanel === "BALANCE" && (
                    <div className="compact-portfolio-inline-panel">
                        <div className="compact-inline-grid">
                            <label>
                                <span>Валюта</span>
                                <select
                                    value={balanceCurrency}
                                    onChange={(event) => setBalanceCurrency(event.target.value as Currency)}
                                >
                                    <option value="RUB">RUB</option>
                                    <option value="USD">USD</option>
                                </select>
                            </label>

                            <label>
                                <span>Новый баланс</span>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={balanceValue}
                                    onChange={(event) => setBalanceValue(event.target.value)}
                                />
                            </label>
                        </div>

                        <button type="button" className="primary-button" onClick={handleSetBalance}>
                            Сохранить
                        </button>
                    </div>
                )}
            </div>

            {report && (
                <AiReportPanel
                    title="AI-анализ портфеля"
                    report={report}
                />
            )}

            <article className="panel compact-holdings-panel">
                <div className="panel-header compact-holdings-header">
                    <div>
                        <h2>Активы и лоты</h2>
                    </div>
                </div>

                {isPriceLoading && groupedHoldings.length === 0 ? (
                    <div className="empty-state">Загружаем портфель...</div>
                ) : groupedHoldings.length === 0 ? (
                    <div className="empty-state">Пока нет купленных активов</div>
                ) : (
                    <div className="compact-holdings-list">
                        {groupedHoldings.map((group) => {
                            const isExpanded = Boolean(expandedHoldings[group.ticker]);

                            return (
                                <div className="compact-holding-card" key={group.ticker}>
                                    <div className="compact-holding-line compact-holding-line-main">
                                        <Link to={`/assets/${group.ticker}`} className="compact-holding-main">
                                            <strong>
                                                {formatQuantity(group.quantity)} {group.ticker}
                                            </strong>
                                        </Link>

                                        <div className="compact-holding-metric">
                                            <span>Сейчас</span>
                                            <strong>{formatMoney(group.currentPrice, group.currency)}</strong>
                                        </div>

                                        <div className="compact-holding-metric">
                                            <span>Вложено</span>
                                            <strong>{formatMoney(group.totalInvested, group.currency)}</strong>
                                        </div>

                                        <div className="compact-holding-metric">
                                            <span>Стоимость</span>
                                            <strong>{formatMoney(group.currentValue, group.currency)}</strong>
                                        </div>

                                        <div className="compact-holding-metric">
                                            <span>PNL</span>
                                            <strong className={group.pnl >= 0 ? "positive-value" : "negative-value"}>
                                                {formatMoney(group.pnl, group.currency)} · {formatPercentWithSign(group.pnlPercent)}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="compact-holding-actions">
                                        <button
                                            type="button"
                                            className="primary-button"
                                            onClick={() => {
                                                setExpandedHoldings((current) => ({
                                                    ...current,
                                                    [group.ticker]: !current[group.ticker]
                                                }));
                                            }}
                                        >
                                            {isExpanded ? "Свернуть" : "Развернуть"}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="compact-lot-list">
                                            {group.lots.map((lot) => {
                                                const currentPrice = prices[lot.ticker] ?? 0;
                                                const invested = lot.quantity * lot.purchasePrice;
                                                const currentValue = lot.quantity * currentPrice;
                                                const pnl = currentValue - invested;
                                                const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

                                                return (
                                                    <div className="compact-lot-card" key={lot.id}>
                                                        <div className="compact-holding-line compact-lot-line">
                                                            <div className="compact-holding-main">
                                                                <strong>
                                                                    {formatQuantity(lot.quantity)} {lot.ticker} {formatDateTime(lot.purchasedAt)}
                                                                </strong>
                                                            </div>

                                                            <div className="compact-holding-metric">
                                                                <span>Сейчас</span>
                                                                <strong>{formatMoney(currentPrice, lot.currency)}</strong>
                                                            </div>

                                                            <div className="compact-holding-metric">
                                                                <span>Вложено</span>
                                                                <strong>{formatMoney(invested, lot.currency)}</strong>
                                                            </div>

                                                            <div className="compact-holding-metric">
                                                                <span>Стоимость</span>
                                                                <strong>{formatMoney(currentValue, lot.currency)}</strong>
                                                            </div>

                                                            <div className="compact-holding-metric">
                                                                <span>PNL</span>
                                                                <strong className={pnl >= 0 ? "positive-value" : "negative-value"}>
                                                                    {formatMoney(pnl, lot.currency)} · {formatPercentWithSign(pnlPercent)}
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        <div className="compact-holding-actions compact-lot-actions">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={lot.quantity}
                                                                step="0.0001"
                                                                placeholder="Кол-во"
                                                                value={sellQuantities[lot.id] ?? ""}
                                                                onChange={(event) => {
                                                                    setSellQuantities((current) => ({
                                                                        ...current,
                                                                        [lot.id]: event.target.value
                                                                    }));
                                                                }}
                                                            />

                                                            <button
                                                                type="button"
                                                                className="ghost-button danger-sell-button"
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
                            );
                        })}
                    </div>
                )}
            </article>

            <details className="panel compact-portfolio-details">
                <summary>
                    <div>
                        <h2>Статистика</h2>
                        <span>
                            Активов {statistics.assetsCount} · Лотов {statistics.lotsCount}
                        </span>
                    </div>
                </summary>

                <div className="compact-portfolio-stats-grid">
                    <div className="compact-portfolio-stat">
                        <span>Активов</span>
                        <strong>{statistics.assetsCount}</strong>
                    </div>

                    <div className="compact-portfolio-stat">
                        <span>Лотов</span>
                        <strong>{statistics.lotsCount}</strong>
                    </div>

                    <div className="compact-portfolio-stat">
                        <span>Unrealized</span>
                        <strong className={statistics.unrealized >= 0 ? "positive-value" : "negative-value"}>
                            {formatMoney(statistics.unrealized, detectMainCurrency(groupedHoldings))}
                        </strong>
                    </div>

                    <div className="compact-portfolio-stat">
                        <span>Realized</span>
                        <strong className={statistics.realized >= 0 ? "positive-value" : "negative-value"}>
                            {formatMoney(statistics.realized, detectMainCurrency(groupedHoldings))}
                        </strong>
                    </div>
                </div>
            </details>

            <details className="panel compact-portfolio-details">
                <summary>
                    <div>
                        <h2>Закрытые сделки</h2>
                        <span>{portfolioState.closedTrades.length}</span>
                    </div>
                </summary>

                {portfolioState.closedTrades.length === 0 ? (
                    <div className="empty-state">Закрытых сделок пока нет</div>
                ) : (
                    <div className="compact-closed-trades-list">
                        {portfolioState.closedTrades.map((trade) => {
                            const pnl = (trade.sellPrice - trade.purchasePrice) * trade.quantity;
                            const invested = trade.purchasePrice * trade.quantity;
                            const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;

                            return (
                                <div className={`compact-closed-trade-line ${pnl >= 0 ? "closed-trade-profit" : "closed-trade-loss"}`} key={trade.id}>
                                    <strong>
                                        {formatQuantity(trade.quantity)} {trade.ticker}
                                    </strong>

                                    <span>{formatDateTime(trade.soldAt)}</span>

                                    <span>{formatMoney(trade.sellPrice, trade.currency)}</span>

                                    <em className={pnl >= 0 ? "positive-value" : "negative-value"}>
                                        {formatMoney(pnl, trade.currency)} · {formatPercentWithSign(pnlPercent)}
                                    </em>
                                </div>
                            );
                        })}
                    </div>
                )}
            </details>

            <details className="panel compact-portfolio-details">
                <summary>
                    <div>
                        <h2>История операций</h2>
                        <span>{portfolioState.transactions.length}</span>
                    </div>
                </summary>

                {portfolioState.transactions.length === 0 ? (
                    <div className="empty-state">Операций пока нет</div>
                ) : (
                    <div className="compact-closed-trades-list">
                        {portfolioState.transactions.map((transaction) => (
                            <div
                                className={`compact-closed-trade-line ${
                                    transaction.type === "BUY"
                                        ? "transaction-buy-line"
                                        : transaction.type === "SELL"
                                            ? "transaction-sell-line"
                                            : ""
                                }`}
                                key={transaction.id}
                            >
                                <strong
                                    className={
                                        transaction.type === "BUY"
                                            ? "transaction-buy-label"
                                            : transaction.type === "SELL"
                                                ? "transaction-sell-label"
                                                : ""
                                    }
                                >
                                    {translateTransactionType(transaction.type)}
                                </strong>
                                <span>{transaction.ticker ?? transaction.currency}</span>
                                <span>{formatMoney(transaction.amount, transaction.currency)}</span>
                                <em>{formatDateTime(transaction.createdAt)}</em>
                            </div>
                        ))}
                    </div>
                )}
            </details>
        </section>
    );
}

function loadPortfolioState(): PersistedPortfolioState {
    for (const key of LEGACY_STORAGE_KEYS) {
        const rawValue = window.localStorage.getItem(key);

        if (!rawValue) {
            continue;
        }

        try {
            const parsed = JSON.parse(rawValue);
            return normalizePersistedState(parsed);
        } catch {
            continue;
        }
    }

    return {
        balances: {
            RUB: 0,
            USD: 0
        },
        lots: [],
        closedTrades: [],
        transactions: []
    };
}

function normalizePersistedState(value: unknown): PersistedPortfolioState {
    const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

    const balancesSource = (source.balances ??
        source.account ??
        {}) as Record<string, unknown>;

    const lotsSource = (source.lots ??
        source.openLots ??
        source.portfolioLots ??
        []) as unknown[];

    const closedTradesSource = (source.closedTrades ??
        source.closed ??
        source.history ??
        []) as unknown[];

    const transactionsSource = (source.transactions ??
        source.operations ??
        []) as unknown[];

    return {
        balances: {
            RUB: toNumber(balancesSource.RUB ?? balancesSource.rub ?? balancesSource.rubBalance),
            USD: toNumber(balancesSource.USD ?? balancesSource.usd ?? balancesSource.usdBalance)
        },
        lots: lotsSource
            .map(normalizeLot)
            .filter((item): item is PortfolioLot => Boolean(item)),
        closedTrades: closedTradesSource
            .map(normalizeClosedTrade)
            .filter((item): item is ClosedTrade => Boolean(item)),
        transactions: transactionsSource
            .map(normalizeTransaction)
            .filter((item): item is PortfolioTransaction => Boolean(item))
    };
}

function normalizeLot(value: unknown): PortfolioLot | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const source = value as Record<string, unknown>;
    const ticker = String(source.ticker ?? "");

    if (!ticker) {
        return null;
    }

    return {
        id: String(source.id ?? cryptoRandomId()),
        ticker,
        quantity: toNumber(source.quantity),
        purchasePrice: toNumber(source.purchasePrice ?? source.buyPrice ?? source.price),
        currency: String(source.currency ?? "RUB").toUpperCase() === "USD" ? "USD" : "RUB",
        purchasedAt: String(source.purchasedAt ?? source.createdAt ?? new Date().toISOString())
    };
}

function normalizeClosedTrade(value: unknown): ClosedTrade | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const source = value as Record<string, unknown>;
    const ticker = String(source.ticker ?? "");

    if (!ticker) {
        return null;
    }

    return {
        id: String(source.id ?? cryptoRandomId()),
        ticker,
        quantity: toNumber(source.quantity),
        purchasePrice: toNumber(source.purchasePrice ?? source.buyPrice),
        sellPrice: toNumber(source.sellPrice ?? source.price),
        currency: String(source.currency ?? "RUB").toUpperCase() === "USD" ? "USD" : "RUB",
        purchasedAt: String(source.purchasedAt ?? source.createdAt ?? new Date().toISOString()),
        soldAt: String(source.soldAt ?? source.closedAt ?? new Date().toISOString())
    };
}

function normalizeTransaction(value: unknown): PortfolioTransaction | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const source = value as Record<string, unknown>;
    const type = String(source.type ?? "BALANCE") as PortfolioTransaction["type"];

    return {
        id: String(source.id ?? cryptoRandomId()),
        type,
        ticker: typeof source.ticker === "string" ? source.ticker : undefined,
        quantity: source.quantity === undefined ? undefined : toNumber(source.quantity),
        price: source.price === undefined ? undefined : toNumber(source.price),
        amount: toNumber(source.amount),
        currency: String(source.currency ?? "RUB").toUpperCase() === "USD" ? "USD" : "RUB",
        createdAt: String(source.createdAt ?? new Date().toISOString())
    };
}

function savePortfolioState(value: PersistedPortfolioState) {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(value));
}

function createTransaction(data: Omit<PortfolioTransaction, "id" | "createdAt">): PortfolioTransaction {
    return {
        ...data,
        id: cryptoRandomId(),
        createdAt: new Date().toISOString()
    };
}

function buildLocalPortfolioReport(
    groups: GroupedHolding[],
    statistics: {
        assetsCount: number;
        lotsCount: number;
        unrealized: number;
        realized: number;
    }
): AiReport {
    const best = [...groups].sort((first, second) => second.pnlPercent - first.pnlPercent)[0] ?? null;
    const worst = [...groups].sort((first, second) => first.pnlPercent - second.pnlPercent)[0] ?? null;
    const concentration = groups.length === 0
        ? 0
        : Math.max(...groups.map((group) => group.currentValue)) /
        Math.max(groups.reduce((sum, group) => sum + group.currentValue, 0), 1);

    const riskScore = clamp(
        Math.round(concentration * 55 + Math.min(statistics.lotsCount * 4, 25)),
        0,
        100
    );

    return {
        provider: "MOCK",
        verdict: groups.length === 0 ? "Портфель пуст" : "Портфель собран",
        summary: `${statistics.assetsCount} активов, ${statistics.lotsCount} лотов, открытый результат ${formatMoney(statistics.unrealized, detectMainCurrency(groups))}.`,
        positiveFactors: [
            best ? `Лучший актив: ${best.ticker} ${formatPercentWithSign(best.pnlPercent)}.` : "Пока нет открытых позиций.",
            statistics.lotsCount > statistics.assetsCount ? "Есть несколько точек входа." : "Структура простая.",
            statistics.realized >= 0 ? "Закрытые сделки не давят на результат." : "Есть история закрытых сделок."
        ],
        negativeFactors: [
            worst ? `Слабый актив: ${worst.ticker} ${formatPercentWithSign(worst.pnlPercent)}.` : "Слабые активы пока не выделены.",
            concentration > 0.6 ? "Есть сильная концентрация в одном активе." : "Концентрация умеренная.",
            "Новости и фундаментальные события не учитываются."
        ],
        actionItems: [
            "Проверить крупнейшую позицию.",
            "Сравнить лучший и худший актив.",
            "Оценить размер нового входа перед покупкой."
        ],
        riskScore,
        riskLevel: riskScore >= 80 ? "CRITICAL" : riskScore >= 60 ? "HIGH" : riskScore >= 35 ? "MEDIUM" : "LOW",
        disclaimer: "Не инвестиционная рекомендация."
    };
}

function parsePositiveNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function detectMainCurrency(groups: GroupedHolding[]): Currency {
    const usdValue = groups
        .filter((group) => group.currency === "USD")
        .reduce((sum, group) => sum + group.currentValue, 0);

    const rubValue = groups
        .filter((group) => group.currency === "RUB")
        .reduce((sum, group) => sum + group.currentValue, 0);

    return usdValue > rubValue ? "USD" : "RUB";
}

function cryptoRandomId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function translateTransactionType(type: PortfolioTransaction["type"]): string {
    if (type === "BUY") return "Покупка";
    if (type === "SELL") return "Продажа";
    if (type === "DEMO_ACCOUNT") return "Демо счёт";

    return "Баланс";
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: currency === "USD" ? 4 : 2
    }).format(value)} ${currency}`;
}

function formatQuantity(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 4
    }).format(value);
}

function formatPercentWithSign(value: number): string {
    return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}

function formatDateTime(value: string): string {
    return new Date(value).toLocaleString("ru-RU");
}