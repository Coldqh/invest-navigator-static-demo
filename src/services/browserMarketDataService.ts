import { DEMO_PRICES } from "../data/demoAssets";
import { getAsset } from "./assetsService";
import type { AnalyticsSummary, Candle, MarketPrice, RiskLevel } from "../types/domain";

export async function getMarketPrice(ticker: string): Promise<MarketPrice> {
    const asset = getAsset(ticker);

    if (!asset) {
        throw new Error(`Asset not found: ${ticker}`);
    }

    if (asset.assetType === "CRYPTO") {
        return getBinancePrice(asset.ticker, asset.name);
    }

    return getMoexPrice(asset.ticker, asset.name);
}

export async function getAnalyticsSummary(ticker: string): Promise<AnalyticsSummary> {
    const price = await getMarketPrice(ticker);
    const candles = await getCandles(ticker);
    const closes = candles.map((candle) => candle.close);
    const firstClose = closes[0] ?? price.price;
    const lastClose = closes[closes.length - 1] ?? price.price;
    const priceChange = lastClose - firstClose;
    const priceChangePercent = firstClose === 0 ? 0 : (priceChange / firstClose) * 100;
    const averageVolume = average(candles.map((candle) => candle.volume));
    const volatilityPercent = calculateVolatilityPercent(closes);
    const riskScore = clamp(Math.round(volatilityPercent * 5 + Math.abs(priceChangePercent) * 1.4), 0, 100);

    return {
        ticker: price.ticker,
        name: price.name,
        currentPrice: price.price,
        firstClose,
        lastClose,
        priceChange,
        priceChangePercent,
        averageVolume,
        volatilityPercent,
        riskScore,
        riskLevel: toRiskLevel(riskScore),
        dataPoints: candles.length,
        source: price.source
    };
}

export async function getCandles(ticker: string): Promise<Candle[]> {
    const asset = getAsset(ticker);

    if (!asset) {
        throw new Error(`Asset not found: ${ticker}`);
    }

    if (asset.assetType === "CRYPTO") {
        return getBinanceCandles(asset.ticker);
    }

    return getDemoCandles(asset.ticker, "MOEX");
}

async function getBinancePrice(ticker: string, name: string): Promise<MarketPrice> {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(ticker)}`);

        if (!response.ok) {
            throw new Error(`Binance failed with ${response.status}`);
        }

        const data = await response.json() as {
            lastPrice: string;
            volume: string;
        };

        return {
            ticker,
            name,
            price: Number(data.lastPrice),
            volume: Number(data.volume),
            source: "BINANCE",
            timestamp: new Date().toISOString()
        };
    } catch {
        return getDemoPrice(ticker, name, "DEMO");
    }
}

async function getMoexPrice(ticker: string, name: string): Promise<MarketPrice> {
    try {
        const url = `https://iss.moex.com/iss/engines/stock/markets/shares/securities/${encodeURIComponent(ticker)}.json?iss.meta=off&iss.only=marketdata&marketdata.columns=SECID,LAST,VALUE,VOLTODAY`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`MOEX failed with ${response.status}`);
        }

        const data = await response.json() as {
            marketdata?: {
                columns?: string[];
                data?: Array<Array<string | number | null>>;
            };
        };

        const columns = data.marketdata?.columns ?? [];
        const row = data.marketdata?.data?.[0];

        if (!row) {
            throw new Error("MOEX empty response");
        }

        const lastIndex = columns.indexOf("LAST");
        const volumeIndex = columns.indexOf("VOLTODAY");
        const valueIndex = columns.indexOf("VALUE");

        const price = Number(row[lastIndex]);
        const volume = Number(row[volumeIndex] ?? row[valueIndex] ?? 0);

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("MOEX LAST is empty");
        }

        return {
            ticker,
            name,
            price,
            volume,
            source: "MOEX",
            timestamp: new Date().toISOString()
        };
    } catch {
        return getDemoPrice(ticker, name, "DEMO");
    }
}

async function getBinanceCandles(ticker: string): Promise<Candle[]> {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(ticker)}&interval=1d&limit=30`);

        if (!response.ok) {
            throw new Error(`Binance candles failed with ${response.status}`);
        }

        const data = await response.json() as Array<Array<number | string>>;

        return data.map((row) => ({
            timestamp: new Date(Number(row[0])).toISOString(),
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
            volume: Number(row[5]),
            source: "BINANCE"
        }));
    } catch {
        return getDemoCandles(ticker, "DEMO");
    }
}

function getDemoPrice(ticker: string, name: string, source: "DEMO"): MarketPrice {
    const basePrice = DEMO_PRICES[ticker] ?? 100;
    const drift = Math.sin(Date.now() / 100000) * basePrice * 0.01;

    return {
        ticker,
        name,
        price: Number((basePrice + drift).toFixed(4)),
        volume: Math.round(basePrice * 1200),
        source,
        timestamp: new Date().toISOString()
    };
}

function getDemoCandles(ticker: string, source: "MOEX" | "DEMO" | "BINANCE"): Candle[] {
    const basePrice = DEMO_PRICES[ticker] ?? 100;
    const now = Date.now();

    return Array.from({ length: 30 }).map((_, index) => {
        const day = 29 - index;
        const timestamp = new Date(now - day * 24 * 60 * 60 * 1000).toISOString();
        const wave = Math.sin(index / 3) * basePrice * 0.03;
        const trend = index * basePrice * 0.002;
        const close = basePrice + wave + trend;
        const open = close * (1 + Math.sin(index) * 0.006);
        const high = Math.max(open, close) * 1.012;
        const low = Math.min(open, close) * 0.988;

        return {
            timestamp,
            open: Number(open.toFixed(4)),
            high: Number(high.toFixed(4)),
            low: Number(low.toFixed(4)),
            close: Number(close.toFixed(4)),
            volume: Math.round(basePrice * (1000 + index * 25)),
            source
        };
    });
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateVolatilityPercent(values: number[]): number {
    if (values.length < 2) {
        return 0;
    }

    const changes = values.slice(1).map((value, index) => {
        const previous = values[index];

        if (previous === 0) {
            return 0;
        }

        return ((value - previous) / previous) * 100;
    });

    return average(changes.map((value) => Math.abs(value)));
}

function toRiskLevel(score: number): RiskLevel {
    if (score >= 80) return "CRITICAL";
    if (score >= 60) return "HIGH";
    if (score >= 35) return "MEDIUM";
    return "LOW";
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
