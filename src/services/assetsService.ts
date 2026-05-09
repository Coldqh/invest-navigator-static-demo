import { DEMO_ASSETS } from "../data/demoAssets";
import type { Asset } from "../types/domain";

export function getAssets(): Asset[] {
    return DEMO_ASSETS;
}

export function getAsset(ticker: string): Asset | null {
    const normalizedTicker = ticker.trim().toUpperCase();

    return DEMO_ASSETS.find((asset) => asset.ticker === normalizedTicker) ?? null;
}
