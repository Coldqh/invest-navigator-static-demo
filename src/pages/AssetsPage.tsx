import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAssets } from "../services/assetsService";

export function AssetsPage() {
    const [query, setQuery] = useState("");
    const assets = getAssets();

    const filteredAssets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        if (!normalizedQuery) {
            return assets;
        }

        return assets.filter((asset) => {
            return asset.ticker.toLowerCase().includes(normalizedQuery) ||
                asset.name.toLowerCase().includes(normalizedQuery);
        });
    }, [assets, query]);

    return (
        <section className="page">
            <div className="page-header">
                <div>
                    <p className="eyebrow">Активы</p>
                    <h1>Рыночный список</h1>
                </div>
            </div>

            <input
                className="search-input"
                value={query}
                placeholder="Поиск по тикеру или названию"
                onChange={(event) => setQuery(event.target.value)}
            />

            <div className="asset-grid">
                {filteredAssets.map((asset) => (
                    <Link to={`/assets/${asset.ticker}`} className="asset-card" key={asset.id}>
                        <strong>{asset.ticker}</strong>
                        <span>{asset.name}</span>
                        <em>{asset.exchange} · {asset.currency}</em>
                    </Link>
                ))}
            </div>
        </section>
    );
}
