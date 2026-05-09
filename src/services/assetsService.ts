import { ASSETS } from "../data/assets";
import type { Asset, AssetType } from "../types/domain";

export function getAssets(): Asset[] {
    return ASSETS.filter((asset) => asset.active);
}

export function getAllAssets(): Asset[] {
    return ASSETS;
}

export function getAsset(ticker: string): Asset | null {
    const normalizedTicker = normalizeTicker(ticker);

    return ASSETS.find((asset) => asset.ticker === normalizedTicker) ?? null;
}

export function getAssetsByType(assetType: AssetType): Asset[] {
    return getAssets().filter((asset) => asset.assetType === assetType);
}

export function searchAssets(query: string): Asset[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
        return getAssets();
    }

    return getAssets().filter((asset) => {
        return (
            asset.ticker.toLowerCase().includes(normalizedQuery) ||
            asset.name.toLowerCase().includes(normalizedQuery) ||
            asset.exchange.toLowerCase().includes(normalizedQuery)
        );
    });
}

export function normalizeTicker(ticker: string): string {
    return ticker.trim().toUpperCase();
}