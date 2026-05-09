import { FormEvent, useEffect, useMemo, useState } from "react";
import { getAssets } from "../services/assetsService";
import {
    buyAsset,
    getSimulator,
    resetPortfolio,
    seedDemoPortfolio,
    sellLot,
    updateAccount
} from "../services/browserPortfolioService";
import { generatePortfolioReport, type AiReport } from "../services/browserAiService";
import type { PortfolioLotView, PortfolioSimulator } from "../types/domain";
import { LoadingBlock } from "../components/LoadingBlock";

export function PortfolioPage() {
    const [simulator, setSimulator] = useState<PortfolioSimulator | null>(null);
    const [rubBalance, setRubBalance] = useState("");
    const [usdBalance, setUsdBalance] = useState("");
    const [buyTicker, setBuyTicker] = useState("SBER");
    const [buyQuantity, setBuyQuantity] = useState("");
    const [expandedTickers, setExpandedTickers] = useState<Record<string, boolean>>({});
    const [sellQuantities, setSellQuantities] = useState<Record<string, string>>({});
    const [report, setReport] = useState<AiReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const assets = getAssets();

    useEffect(() => {
        refresh();
    }, []);

    const filteredAssets = useMemo(() => {
        const query = buyTicker.trim().toLowerCase();

        if (!query) return assets;

        return assets.filter((asset) => asset.ticker.toLowerCase().includes(query) || asset.name.toLowerCase().includes(query));
    }, [assets, buyTicker]);

    async function refresh() {
        setIsLoading(true);
        const loadedSimulator = await getSimulator();
        setSimulator(loadedSimulator);
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

    async function handleAiReport() {
        if (!simulator) return;
        setReport(await generatePortfolioReport(simulator));
    }

    async function handleSeedDemo() {
        seedDemoPortfolio();
        await refresh();
    }

    async function handleReset() {
        resetPortfolio();
        setReport(null);
        await refresh();
    }

    if (isLoading || !simulator) {
        return <LoadingBlock text="Загружаем портфель..." />;
    }

    return (
        <section className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Портфель</p>
                    <h1>Симулятор инвестиций</h1>
                </div>

                <div className="hero-actions">
                    <button type="button" className="ghost-button" onClick={handleSeedDemo}>Демо-данные</button>
                    <button type="button" className="ghost-button danger-button" onClick={handleReset}>Сбросить</button>
                    <button type="button" className="primary-button" onClick={handleAiReport}>AI-анализ</button>
                </div>
            </div>

            {error && <div className="error-block">{error}</div>}

            <article className="panel portfolio-account-panel">
                <div className="panel-header">
                    <div>
                        <h2>Счёт</h2>
                        <p>Баланс хранится в браузере.</p>
                    </div>
                </div>

                <div className="portfolio-account-grid">
                    <div className="portfolio-account-card">
                        <span>RUB</span>
                        <strong>{formatMoney(simulator.account.rubBalance, "RUB")}</strong>
                    </div>
                    <div className="portfolio-account-card">
                        <span>USD</span>
                        <strong>{formatMoney(simulator.account.usdBalance, "USD")}</strong>
                    </div>

                    <form className="portfolio-account-form" onSubmit={handleSaveAccount}>
                        <label>
                            RUB баланс
                            <input value={rubBalance} type="number" min="0" step="0.0001" onChange={(event) => setRubBalance(event.target.value)} />
                        </label>
                        <label>
                            USD баланс
                            <input value={usdBalance} type="number" min="0" step="0.0001" onChange={(event) => setUsdBalance(event.target.value)} />
                        </label>
                        <button type="submit" className="primary-button">Сохранить счёт</button>
                    </form>
                </div>
            </article>

            <article className="panel portfolio-buy-panel">
                <div className="panel-header">
                    <div>
                        <h2>Покупка</h2>
                        <p>Цена берётся из браузерного market data provider.</p>
                    </div>
                </div>

                <form className="portfolio-buy-form" onSubmit={handleBuy}>
                    <label>
                        Тикер
                        <input value={buyTicker} list="portfolio-buy-assets" onChange={(event) => setBuyTicker(event.target.value)} />
                        <datalist id="portfolio-buy-assets">
                            {filteredAssets.map((asset) => <option key={asset.id} value={asset.ticker}>{asset.name}</option>)}
                        </datalist>
                    </label>
                    <label>
                        Количество
                        <input value={buyQuantity} type="number" min="0" step="0.0001" onChange={(event) => setBuyQuantity(event.target.value)} />
                    </label>
                    <button type="submit" className="primary-button">Купить</button>
                </form>
            </article>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Сводка</h2>
                    </div>
                </div>

                <div className="summary-grid">
                    <Summary label="Активов" value={String(simulator.assetsCount)} />
                    <Summary label="Лотов" value={String(simulator.lotsCount)} />
                    <Summary label="RUB PnL" value={formatMoney(simulator.totalRubProfitLoss, "RUB")} />
                    <Summary label="USD PnL" value={formatMoney(simulator.totalUsdProfitLoss, "USD")} />
                </div>
            </article>

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
                                        <span>{holding.name} · {holding.lots.length} лот(ов) · {holding.holdingDays} дн.</span>
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
                                        <button type="button" className="ghost-button" onClick={() => setBuyTicker(holding.ticker)}>Купить</button>
                                        <button
                                            type="button"
                                            className="primary-button"
                                            onClick={() => setExpandedTickers((current) => ({ ...current, [holding.ticker]: !current[holding.ticker] }))}
                                        >
                                            {expandedTickers[holding.ticker] ? "Свернуть" : "Развернуть"}
                                        </button>
                                    </div>
                                </div>

                                {expandedTickers[holding.ticker] && (
                                    <div className="portfolio-lot-list">
                                        {holding.lots.map((lot) => (
                                            <div className="portfolio-line portfolio-lot-line" key={lot.id}>
                                                <div className="portfolio-line-title">
                                                    <strong>{formatNumber(lot.remainingQuantity)} {lot.ticker}</strong>
                                                    <span>{lot.name} · от {formatDateOnly(lot.openedAt)} · {lot.holdingDays} дн.</span>
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
                                                </div>

                                                <div className="portfolio-line-actions portfolio-line-sell-actions">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={lot.remainingQuantity}
                                                        step="0.0001"
                                                        value={sellQuantities[lot.id] ?? ""}
                                                        placeholder="Кол-во"
                                                        onChange={(event) => setSellQuantities((current) => ({ ...current, [lot.id]: event.target.value }))}
                                                    />
                                                    <button type="button" className="ghost-button danger-button" onClick={() => handleSell(lot)}>Продать</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </article>

            <article className="panel">
                <div className="panel-header">
                    <div>
                        <h2>Журнал операций</h2>
                    </div>
                </div>

                <div className="portfolio-transaction-list">
                    {simulator.transactions.map((transaction) => (
                        <div className="portfolio-transaction-card" key={transaction.id}>
                            <span className={transaction.transactionType === "BUY" ? "transaction-buy portfolio-transaction-type" : "transaction-sell portfolio-transaction-type"}>
                                {transaction.transactionType === "BUY" ? "Покупка" : "Продажа"}
                            </span>
                            <strong>{transaction.ticker}</strong>
                            <InlineMetric label="Кол-во" value={formatNumber(transaction.quantity)} />
                            <InlineMetric label="Цена" value={formatMoney(transaction.price, transaction.currency)} />
                            <InlineMetric label="Сумма" value={formatMoney(transaction.totalAmount, transaction.currency)} />
                            <InlineMetric label="Дата" value={formatDateOnly(transaction.executedAt)} />
                        </div>
                    ))}
                </div>
            </article>

            {report && (
                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>AI-анализ</h2>
                            <p>Провайдер: {report.provider}</p>
                        </div>
                    </div>
                    <p>{report.summary}</p>
                    <small>{report.disclaimer}</small>
                </article>
            )}
        </section>
    );
}

type SummaryProps = {
    label: string;
    value: string;
};

function Summary({ label, value }: SummaryProps) {
    return (
        <div className="summary-card">
            <span>{label}</span>
            <strong>{value}</strong>
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

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 8 }).format(value);
}

function formatMoney(value: number, currency: string): string {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(value)} ${currency}`;
}

function formatPercent(value: number): string {
    return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatDateOnly(value: string): string {
    const date = new Date(value);
    return date.toLocaleDateString("ru-RU");
}
