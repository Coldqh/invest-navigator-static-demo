import { FormEvent, useState } from "react";
import { getAnalyticsSummary } from "../services/browserMarketDataService";
import type { AnalyticsSummary } from "../types/domain";

export function ComparePage() {
    const [firstTicker, setFirstTicker] = useState("SBER");
    const [secondTicker, setSecondTicker] = useState("BTCUSDT");
    const [items, setItems] = useState<AnalyticsSummary[]>([]);
    const [error, setError] = useState("");

    async function handleCompare(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        try {
            setError("");

            const loadedItems = await Promise.all([
                getAnalyticsSummary(firstTicker.trim().toUpperCase()),
                getAnalyticsSummary(secondTicker.trim().toUpperCase())
            ]);

            setItems(loadedItems);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "Ошибка сравнения");
        }
    }

    return (
        <section className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Сравнение</p>
                    <h1>Два актива рядом</h1>
                </div>
            </div>

            {error && <div className="error-block">{error}</div>}

            <form className="compare-form" onSubmit={handleCompare}>
                <input value={firstTicker} onChange={(event) => setFirstTicker(event.target.value)} />
                <input value={secondTicker} onChange={(event) => setSecondTicker(event.target.value)} />
                <button type="submit" className="primary-button">Сравнить</button>
            </form>

            <div className="dashboard-grid">
                {items.map((item) => (
                    <article className="panel" key={item.ticker}>
                        <h2>{item.ticker}</h2>
                        <div className="summary-grid">
                            <Summary label="Цена" value={String(item.currentPrice)} />
                            <Summary label="Изменение" value={`${item.priceChangePercent.toFixed(2)}%`} />
                            <Summary label="Волатильность" value={`${item.volatilityPercent.toFixed(2)}%`} />
                            <Summary label="Риск" value={`${item.riskScore}/100`} />
                        </div>
                    </article>
                ))}
            </div>
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
