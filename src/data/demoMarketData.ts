import type { MarketDataSource } from "../types/domain";

export const DEMO_PRICES: Record<string, number> = {
    SBER: 312.45,
    GAZP: 154.2,
    LKOH: 7345,
    YDEX: 4280,
    VTBR: 0.083,
    ROSN: 565.4,
    MGNT: 6120,
    AFLT: 57.8,

    BTCUSDT: 68450,
    ETHUSDT: 3550,
    BNBUSDT: 625,
    SOLUSDT: 168,
    XRPUSDT: 0.62,
    DOGEUSDT: 0.15
};

export function createDemoPriceDrift(ticker: string): number {
    const basePrice = DEMO_PRICES[ticker] ?? 100;
    const tickerSeed = ticker
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);

    const wave = Math.sin(Date.now() / 100000 + tickerSeed) * basePrice * 0.012;

    return Number((basePrice + wave).toFixed(4));
}

export function createDemoCandles(
    ticker: string,
    source: MarketDataSource = "DEMO",
    days = 30
) {
    const basePrice = DEMO_PRICES[ticker] ?? 100;
    const now = Date.now();
    const tickerSeed = ticker
        .split("")
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);

    return Array.from({ length: days }).map((_, index) => {
        const day = days - 1 - index;
        const timestamp = new Date(now - day * 24 * 60 * 60 * 1000).toISOString();

        const wave = Math.sin((index + tickerSeed) / 3) * basePrice * 0.035;
        const smallWave = Math.cos((index + tickerSeed) / 2) * basePrice * 0.012;
        const trend = index * basePrice * 0.0017;
        const close = basePrice + wave + smallWave + trend;
        const open = close * (1 + Math.sin(index + tickerSeed) * 0.006);
        const high = Math.max(open, close) * 1.012;
        const low = Math.min(open, close) * 0.988;

        return {
            timestamp,
            open: Number(open.toFixed(4)),
            high: Number(high.toFixed(4)),
            low: Number(low.toFixed(4)),
            close: Number(close.toFixed(4)),
            volume: Math.round(basePrice * (1000 + index * 28 + tickerSeed)),
            source
        };
    });
}