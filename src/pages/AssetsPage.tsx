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
        const stockAssets = assets.filter((asset) => asset.assetType === "STOCK");
        const cryptoAssets = assets.filter((asset) => asset.assetType === "CRYPTO");
        const otherAssets = assets.filter((asset) => {
            return asset.assetType !== "STOCK" && asset.assetType !== "CRYPTO";
        });

        return [
            {
                id: "crypto",
                title: "РљСЂРёРїС‚Р°",
                assets: cryptoAssets
            },
            {
                id: "stocks",
                title: "РђРєС†РёРё",
                assets: stockAssets
            },
            {
                id: "other",
                title: "РџСЂРѕС‡РµРµ",
                assets: otherAssets
            }
        ].filter((group) => group.assets.length > 0);
    }, [assets]);

    if (isLoading) {
        return <LoadingBlock text="Р—Р°РіСЂСѓР¶Р°РµРј Р°РєС‚РёРІС‹..." />;
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
        <Link to={`/assets/${asset.ticker}`} className="asset-thin-row">
            <img
                className="asset-row-icon"
                src={`/asset-icons-real/${asset.ticker}.png`}
                alt={asset.ticker}
                onError={(event) => {
                    event.currentTarget.src = "/asset-icons-real/FALLBACK.png";
                }}
            />
            <strong>{asset.ticker}</strong>
            <span>{formatAssetName(asset)}</span>
            <b>
                {analytics
                    ? `${formatNumber(analytics.currentPrice)} ${asset.currency}`
                    : `вЂ” ${asset.currency}`}
            </b>
            <i className={isPositive ? "positive-value" : "negative-value"}>
                {analytics ? formatPercentWithSign(change) : "вЂ”"}
            </i>
            <small className={analytics ? getRiskClassName(analytics.riskScore) : ""}>
                {analytics ? `${analytics.riskScore}/100` : "вЂ”"}
            </small>
        </Link>
    );
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
