import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LoadingBlock } from "../components/LoadingBlock";
import { getAssets } from "../services/assetsService";
import { getAnalyticsSummary } from "../services/marketDataService";
import type { AnalyticsSummary, Asset } from "../types/domain";

export function AssetsPage() {
    const assets = useMemo(() => getAssets(), []);
    const [analyticsMap, setAnalyticsMap] = useState<Record<string, AnalyticsSummary>>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            setIsLoading(true);

            const loadedAnalytics = await Promise.all(
                assets.map(async (asset) => {
                    try {
                        return await getAnalyticsSummary(asset.ticker);
                    } catch {
                        return null;
                    }
                })
            );

            const nextMap: Record<string, AnalyticsSummary> = {};

            loadedAnalytics.forEach((item) => {
                if (item) {
                    nextMap[item.ticker] = item;
                }
            });

            setAnalyticsMap(nextMap);
            setIsLoading(false);
        }

        load();
    }, [assets]);

    const groups = useMemo(() => {
        const cryptoAssets = assets.filter((asset) => asset.assetType === "CRYPTO");
        const stockAssets = assets.filter((asset) => asset.assetType === "STOCK");
        const otherAssets = assets.filter((asset) => {
            return asset.assetType !== "STOCK" && asset.assetType !== "CRYPTO";
        });

        return [
            {
                id: "crypto",
                title: "Крипта",
                assets: cryptoAssets
            },
            {
                id: "stocks",
                title: "Акции",
                assets: stockAssets
            },
            {
                id: "other",
                title: "Прочее",
                assets: otherAssets
            }
        ].filter((group) => group.assets.length > 0);
    }, [assets]);

    if (isLoading) {
        return <LoadingBlock text="Загружаем активы..." />;
    }

    return (
        <section className="page assets-page assets-page-ultra-compact">
            <div className="asset-category-list">
                {groups.map((group) => (
                    <details className="panel asset-category-panel" key={group.id} open>
                        <summary className="asset-category-summary">
                            <div>
                                <h2>{group.title}</h2>
                                <span>{group.assets.length}</span>
                            </div>
                        </summary>

                        <div className="asset-category-body">
                            {group.assets.map((asset) => (
                                <AssetThinRow
                                    key={asset.id}
                                    asset={asset}
                                    analytics={analyticsMap[asset.ticker] ?? null}
                                />
                            ))}
                        </div>
                    </details>
                ))}
            </div>
        </section>
    );
}

type AssetThinRowProps = {
    asset: Asset;
    analytics: AnalyticsSummary | null;
};

function AssetThinRow({ asset, analytics }: AssetThinRowProps) {
    const change = analytics?.priceChangePercent ?? 0;
    const isPositive = change >= 0;

    return (
        <Link to={`/assets/${asset.ticker}`} className="asset-thin-row asset-thin-row-fixed">
            <img
                className="asset-row-icon"
                src={getAssetIconSrc(asset.ticker)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(event) => {
                    event.currentTarget.src = getAssetIconSrc("FALLBACK");
                }}
            />

            <strong>{asset.ticker}</strong>

            <span>{formatAssetName(asset)}</span>

            <b>
                {analytics
                    ? `${formatNumber(analytics.currentPrice)} ${asset.currency}`
                    : `— ${asset.currency}`}
            </b>

            <i className={isPositive ? "positive-value" : "negative-value"}>
                {analytics ? formatPercentWithSign(change) : "—"}
            </i>

            <small className={analytics ? getRiskClassName(analytics.riskScore) : ""}>
                {analytics ? `${analytics.riskScore}/100` : "—"}
            </small>
        </Link>
    );
}

function getAssetIconSrc(ticker: string): string {
    const normalizedTicker = ticker.toUpperCase();
    const iconTicker = normalizedTicker === "DOGE" ? "DOGEUSDT" : normalizedTicker;

    return `${import.meta.env.BASE_URL}asset-icons-real/${iconTicker}.png`;
}

function getRiskClassName(score: number): string {
    if (score >= 75) {
        return "risk-critical-value";
    }

    if (score >= 55) {
        return "risk-high-value";
    }

    if (score >= 32) {
        return "risk-medium-value";
    }

    return "risk-low-value";
}

function formatAssetName(asset: Asset): string {
    return asset.name
        .replace(/\s*\/\s*Tether$/i, "")
        .replace(/\s*\/\s*USDT$/i, "")
        .trim();
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 8
    }).format(value);
}

function formatPercentWithSign(value: number): string {
    return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", {
        maximumFractionDigits: 2
    }).format(value)}%`;
}
